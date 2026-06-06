import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Overview } from "@/pages/Overview";
import { RemittanceDetail } from "@/pages/RemittanceDetail";
import { VersionCompare } from "@/pages/VersionCompare";
import { History } from "@/pages/History";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/remittance/:id" element={<RemittanceDetail />} />
          <Route path="/compare" element={<VersionCompare />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </div>
    </Router>
  );
}
