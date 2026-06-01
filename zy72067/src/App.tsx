import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import Workbench from "@/pages/Workbench";
import TraceReport from "@/pages/TraceReport";

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/workbench" element={<Workbench />} />
            <Route path="/trace" element={<TraceReport />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
