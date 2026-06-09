import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import PetDetail from "@/pages/PetDetail";
import ExportCenter from "@/pages/ExportCenter";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pet/:id" element={<PetDetail />} />
        <Route path="/export" element={<ExportCenter />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Router>
  );
}
