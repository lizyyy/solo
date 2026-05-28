import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import CalibrationPage from "@/pages/CalibrationPage";
import ReportPage from "@/pages/ReportPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<CalibrationPage />} />
        <Route path="/report/:id" element={<ReportPage />} />
      </Routes>
    </Router>
  );
}
