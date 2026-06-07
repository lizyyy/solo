import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import BreakpointsList from "@/pages/BreakpointsList";
import BreakpointDetail from "@/pages/BreakpointDetail";
import ImportPage from "@/pages/ImportPage";
import HistoryPage from "@/pages/HistoryPage";
import VisualizationPage from "@/pages/VisualizationPage";
import RulesPage from "@/pages/RulesPage";
import NotificationToast from "@/components/ui/NotificationToast";
import FriendlyErrorAlert from "@/components/ui/FriendlyErrorAlert";

export default function App() {
  return (
    <Router>
      <NotificationToast />
      <FriendlyErrorAlert />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/breakpoints" element={<BreakpointsList />} />
          <Route path="/breakpoints/:id" element={<BreakpointDetail />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/visualization" element={<VisualizationPage />} />
          <Route path="/rules" element={<RulesPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
