import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { TimelinePage } from "@/pages/TimelinePage";
import { ExportPage } from "@/pages/ExportPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TimelinePage />} />
        <Route path="/export" element={<ExportPage />} />
      </Routes>
    </Router>
  );
}
