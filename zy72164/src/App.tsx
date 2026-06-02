import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MapPage from "@/pages/MapPage";
import DetailPage from "@/pages/DetailPage";
import ExportPage from "@/pages/ExportPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/alert/:id" element={<DetailPage />} />
        <Route path="/export" element={<ExportPage />} />
      </Routes>
    </Router>
  );
}
