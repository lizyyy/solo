import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Workbench from "@/pages/Workbench";
import ImportPage from "@/pages/Import";
import RecordDetail from "@/pages/RecordDetail";
import ExportPage from "@/pages/Export";
import RulesPage from "@/pages/Rules";
import { ExportLogsList, ExportLogDetail } from "@/pages/ExportLogs";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Workbench />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/record/:id" element={<RecordDetail />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/export-logs" element={<ExportLogsList />} />
          <Route path="/export-logs/:id" element={<ExportLogDetail />} />
          <Route path="/rules" element={<RulesPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
