import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import DataImport from "@/pages/DataImport";
import ConflictDetection from "@/pages/ConflictDetection";
import VersionTracking from "@/pages/VersionTracking";
import { useStore } from "@/store/useStore";

export default function App() {
  const loadPersistedData = useStore((s) => s.loadPersistedData);

  useEffect(() => {
    loadPersistedData();
  }, [loadPersistedData]);

  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<DataImport />} />
          <Route path="/conflicts" element={<ConflictDetection />} />
          <Route path="/versions" element={<VersionTracking />} />
        </Route>
      </Routes>
    </Router>
  );
}
