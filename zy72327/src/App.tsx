import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Workbench from "@/pages/Workbench";
import ConflictResolve from "@/pages/ConflictResolve";
import ForecastResult from "@/pages/ForecastResult";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50">
        <Routes>
          <Route path="/" element={<Workbench />} />
          <Route path="/conflicts" element={<ConflictResolve />} />
          <Route path="/results" element={<ForecastResult />} />
        </Routes>
      </div>
    </Router>
  );
}
