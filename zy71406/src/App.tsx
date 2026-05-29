import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import RedemptionList from "@/pages/RedemptionList";
import RedemptionDetail from "@/pages/RedemptionDetail";
import OperationLogs from "@/pages/OperationLogs";
import AnnouncementManagement from "@/pages/AnnouncementManagement";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/redemption-list" replace />} />
        <Route element={<Layout />}>
          <Route path="/redemption-list" element={<RedemptionList />} />
          <Route path="/redemption-list/:id" element={<RedemptionDetail />} />
          <Route path="/operation-logs" element={<OperationLogs />} />
          <Route path="/announcement-management" element={<AnnouncementManagement />} />
        </Route>
      </Routes>
    </Router>
  );
}
