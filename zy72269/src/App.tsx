import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import Dashboard from "@/pages/Dashboard";
import DataImport from "@/pages/DataImport";
import PathReplay from "@/pages/PathReplay";
import ConflictResolution from "@/pages/ConflictResolution";
import ZAxisReview from "@/pages/ZAxisReview";
import SelfCheckCenter from "@/pages/SelfCheckCenter";
import ReportExport from "@/pages/ReportExport";
import SampleWalkthrough from "@/pages/SampleWalkthrough";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<DataImport />} />
          <Route path="/replay" element={<PathReplay />} />
          <Route path="/conflicts" element={<ConflictResolution />} />
          <Route path="/abnormal" element={<ZAxisReview />} />
          <Route path="/self-check" element={<SelfCheckCenter />} />
          <Route path="/report" element={<ReportExport />} />
          <Route path="/sample" element={<SampleWalkthrough />} />
        </Route>
      </Routes>
    </Router>
  );
}
