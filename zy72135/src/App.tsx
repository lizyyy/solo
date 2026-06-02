import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import RecordDetail from "@/pages/RecordDetail";
import SupplementRecord from "@/pages/SupplementRecord";
import ExportPreview from "@/pages/ExportPreview";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/record/:id" element={<RecordDetail />} />
        <Route path="/record/:id/supplement" element={<SupplementRecord />} />
        <Route path="/export" element={<ExportPreview />} />
      </Routes>
    </Router>
  );
}
