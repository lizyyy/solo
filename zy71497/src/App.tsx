import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Students from "@/pages/Students";
import Checkin from "@/pages/Checkin";
import LeaveMakeup from "@/pages/LeaveMakeup";
import Rewards from "@/pages/Rewards";
import Export from "@/pages/Export";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Students />} />
          <Route path="/checkin" element={<Checkin />} />
          <Route path="/leave" element={<LeaveMakeup />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/export" element={<Export />} />
        </Routes>
      </Layout>
    </Router>
  );
}
