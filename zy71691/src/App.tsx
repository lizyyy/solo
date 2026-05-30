import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import YardPage from "@/pages/YardPage";
import ReplayPage from "@/pages/ReplayPage";
import ReportsPage from "@/pages/ReportsPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<YardPage />} />
        <Route path="/replay" element={<ReplayPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>
    </Router>
  );
}
