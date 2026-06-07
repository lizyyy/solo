import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Complaints from "@/pages/Complaints";
import ComplaintDetail from "@/pages/ComplaintDetail";
import Review from "@/pages/Review";
import SelfCheck from "@/pages/SelfCheck";
import Export from "@/pages/Export";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/complaints" element={<Complaints />} />
          <Route path="/complaints/:id" element={<ComplaintDetail />} />
          <Route path="/review" element={<Review />} />
          <Route path="/self-check" element={<SelfCheck />} />
          <Route path="/export" element={<Export />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}
