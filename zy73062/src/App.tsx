import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ScheduleList from "@/pages/ScheduleList";
import ScheduleDetail from "@/pages/ScheduleDetail";
import TrialRun from "@/pages/TrialRun";
import HandoverView from "@/pages/HandoverView";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/schedule" replace />} />
        <Route path="/schedule" element={<ScheduleList />} />
        <Route path="/schedule/:bizKey" element={<ScheduleDetail />} />
        <Route path="/trial" element={<TrialRun />} />
        <Route path="/handover" element={<HandoverView />} />
        <Route path="*" element={<Navigate to="/schedule" replace />} />
      </Routes>
    </Router>
  );
}
