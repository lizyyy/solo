import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import ProblemListPage from "@/pages/ProblemListPage";
import ReviewPage from "@/pages/ReviewPage";
import DemoDataPage from "@/pages/DemoDataPage";
import ExportPage from "@/pages/ExportPage";

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-academic-50/30">
        <Sidebar />
        <div className="flex-1 min-w-0">
          <Routes>
            <Route path="/" element={<ProblemListPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/review/:id" element={<ReviewPage />} />
            <Route path="/demo" element={<DemoDataPage />} />
            <Route path="/export" element={<ExportPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
