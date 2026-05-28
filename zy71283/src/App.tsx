import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Overview from "@/pages/Overview";
import WorkDetail from "@/pages/WorkDetail";
import Report from "@/pages/Report";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-bg-primary">
        <Sidebar />
        <main className="pl-56 min-h-screen">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/work/:id" element={<WorkDetail />} />
            <Route path="/report" element={<Report />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
