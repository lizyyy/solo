import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import ImportPage from "./pages/ImportPage";
import MergePage from "./pages/MergePage";
import ReviewPage from "./pages/ReviewPage";
import ExportPage from "./pages/ExportPage";

export default function App() {
  return (
    <Router>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto grain-overlay">
          <Routes>
            <Route path="/" element={<ImportPage />} />
            <Route path="/merge" element={<MergePage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/export" element={<ExportPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
