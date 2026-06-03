import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import Home from "@/pages/Home";
import SafetyRadius from "@/pages/SafetyRadius";
import OriginSpec from "@/pages/OriginSpec";
import Obstruction from "@/pages/Obstruction";
import HistoryPage from "@/pages/HistoryPage";

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />
        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-5xl mx-auto">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/safety-radius" element={<SafetyRadius />} />
              <Route path="/origin-spec" element={<OriginSpec />} />
              <Route path="/obstruction" element={<Obstruction />} />
              <Route path="/history" element={<HistoryPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}
