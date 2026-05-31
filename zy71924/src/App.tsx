import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import RecordDetail from "@/pages/RecordDetail";
import PendingCenter from "@/pages/PendingCenter";
import ExportSettings from "@/pages/ExportSettings";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/record/:id" element={<RecordDetail />} />
          <Route path="/pending" element={<PendingCenter />} />
          <Route path="/export" element={<ExportSettings />} />
        </Routes>
      </Layout>
    </Router>
  );
}
