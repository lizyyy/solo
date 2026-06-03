import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { LogsPage } from "@/pages/LogsPage";
import { RadiusPage } from "@/pages/RadiusPage";
import { ReportPage } from "@/pages/ReportPage";
import { DemoPage } from "@/pages/DemoPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/radius" element={<RadiusPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/demo" element={<DemoPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
