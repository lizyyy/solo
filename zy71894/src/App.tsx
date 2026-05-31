import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import ScheduleListPage from "@/pages/ScheduleListPage";
import ScheduleDetailPage from "@/pages/ScheduleDetailPage";
import ReportPage from "@/pages/ReportPage";
import TeamRecordsPage from "@/pages/TeamRecordsPage";
import ConditionLogsPage from "@/pages/ConditionLogsPage";
import ThresholdsPage from "@/pages/ThresholdsPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/schedule" replace />} />
        <Route element={<Layout />}>
          <Route path="/schedule" element={<ScheduleListPage />} />
          <Route path="/schedule/:id" element={<ScheduleDetailPage />} />
          <Route path="/report/:id" element={<ReportPage />} />
          <Route path="/team-records" element={<TeamRecordsPage />} />
          <Route path="/condition-logs" element={<ConditionLogsPage />} />
          <Route path="/thresholds" element={<ThresholdsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
