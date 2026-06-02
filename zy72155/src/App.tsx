import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import PointDetail from "@/pages/PointDetail";
import FeedbackEntry from "@/pages/FeedbackEntry";
import MergeManagement from "@/pages/MergeManagement";
import ReportExport from "@/pages/ReportExport";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/point/:id" element={<PointDetail />} />
          <Route path="/feedback/new" element={<FeedbackEntry />} />
          <Route path="/merge" element={<MergeManagement />} />
          <Route path="/export" element={<ReportExport />} />
        </Route>
      </Routes>
    </Router>
  );
}
