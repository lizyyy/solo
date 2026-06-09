import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import ImportCenter from "@/pages/ImportCenter";
import ScheduleList from "@/pages/ScheduleList";
import AnomalyTracker from "@/pages/AnomalyTracker";
import OperationLog from "@/pages/OperationLog";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<ImportCenter />} />
          <Route path="/schedules" element={<ScheduleList />} />
          <Route path="/anomalies" element={<AnomalyTracker />} />
          <Route path="/logs" element={<OperationLog />} />
          <Route path="*" element={<Dashboard />} />
        </Route>
      </Routes>
    </Router>
  );
}
