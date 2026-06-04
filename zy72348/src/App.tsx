import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import ImportPage from "@/pages/ImportPage";
import ConflictsPage from "@/pages/ConflictsPage";
import WorkflowPage from "@/pages/WorkflowPage";
import HistoryPage from "@/pages/HistoryPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/conflicts" element={<ConflictsPage />} />
          <Route path="/workflow" element={<WorkflowPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
