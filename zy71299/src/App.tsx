import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import DataInputPage from "@/pages/DataInputPage";
import ComputePage from "@/pages/ComputePage";
import ConflictPage from "@/pages/ConflictPage";
import ReportPage from "@/pages/ReportPage";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
        <Route path="/" element={<Navigate to="/input" replace />} />
        <Route path="/input" element={<DataInputPage />} />
        <Route path="/compute" element={<ComputePage />} />
        <Route path="/conflict" element={<ConflictPage />} />
        <Route path="/report" element={<ReportPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
