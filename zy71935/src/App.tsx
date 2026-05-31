import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Workbench from "@/pages/Workbench";
import ChangesAnalysis from "@/pages/ChangesAnalysis";
import ExportCenter from "@/pages/ExportCenter";
import SettingsPage from "@/pages/Settings";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Workbench />} />
          <Route path="/changes" element={<ChangesAnalysis />} />
          <Route path="/export" element={<ExportCenter />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
