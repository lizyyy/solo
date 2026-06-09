import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import ModelView from "@/pages/ModelView";
import MinutesPage from "@/pages/MinutesPage";
import MaterialsPage from "@/pages/MaterialsPage";
import AnomaliesPage from "@/pages/AnomaliesPage";
import ExportPage from "@/pages/ExportPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/model" element={<ModelView />} />
          <Route path="/minutes" element={<MinutesPage />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/anomalies" element={<AnomaliesPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="*" element={<Dashboard />} />
        </Route>
      </Routes>
    </Router>
  );
}
