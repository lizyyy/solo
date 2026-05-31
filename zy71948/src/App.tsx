import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { CalendarPage } from "@/pages/CalendarPage";
import { DataEntryPage } from "@/pages/DataEntryPage";
import { AnomalyPage } from "@/pages/AnomalyPage";
import { BriefingPage } from "@/pages/BriefingPage";
import { useEffect } from "react";
import { usePowerBudgetStore } from "@/store/usePowerBudgetStore";

function AppInitializer() {
  const { initMockData, loadFromLocalStorage } = usePowerBudgetStore();

  useEffect(() => {
    const loaded = loadFromLocalStorage();
    if (!loaded) {
      initMockData();
    }
  }, [initMockData, loadFromLocalStorage]);

  return null;
}

export default function App() {
  return (
    <Router>
      <AppInitializer />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/calendar" replace />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="entry" element={<DataEntryPage />} />
          <Route path="anomaly" element={<AnomalyPage />} />
          <Route path="briefing" element={<BriefingPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
