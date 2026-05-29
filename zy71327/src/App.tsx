import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import SamplePackList from "@/pages/SamplePackList";
import SamplePackDetail from "@/pages/SamplePackDetail";
import TrackDetail from "@/pages/TrackDetail";
import Report from "@/pages/Report";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="sample-packs" element={<SamplePackList />} />
          <Route path="sample-packs/:id" element={<SamplePackDetail />} />
          <Route path="tracks/:id" element={<TrackDetail />} />
          <Route path="report" element={<Report />} />
        </Route>
      </Routes>
    </Router>
  );
}
