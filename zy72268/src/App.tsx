import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ImportPage } from "@/pages/ImportPage";
import { WorkbenchPage } from "@/pages/WorkbenchPage";
import { ConflictsPage } from "@/pages/ConflictsPage";
import { SelfCheckPage } from "@/pages/SelfCheckPage";
import { AuditPage } from "@/pages/AuditPage";
import { useAppStore } from "@/store";
import { useEffect, useRef } from "react";

function AppContent() {
  const location = useLocation();
  const loadAllData = useAppStore((s) => s.loadAllData);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadAllData();
    }
  }, [loadAllData]);

  const isWorkbench = location.pathname === "/workbench";

  if (isWorkbench) {
    return <WorkbenchPage />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ImportPage />} />
        <Route path="/conflicts" element={<ConflictsPage />} />
        <Route path="/self-check" element={<SelfCheckPage />} />
        <Route path="/audit" element={<AuditPage />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
