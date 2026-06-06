import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { EvidenceList } from "@/pages/EvidenceList";
import { EvidenceDetail } from "@/pages/EvidenceDetail";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<EvidenceList />} />
        <Route path="/evidence/:id" element={<EvidenceDetail />} />
      </Routes>
    </Router>
  );
}
