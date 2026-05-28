import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import CaseOpen from "@/pages/CaseOpen";
import ClueSelect from "@/pages/ClueSelect";
import Judge from "@/pages/Judge";
import Settle from "@/pages/Settle";
import Replay from "@/pages/Replay";
import Report from "@/pages/Report";
import Review from "@/pages/Review";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/case/:id" element={<CaseOpen />} />
        <Route path="/case/:id/clues" element={<ClueSelect />} />
        <Route path="/case/:id/judge" element={<Judge />} />
        <Route path="/case/:id/settle" element={<Settle />} />
        <Route path="/case/:id/replay" element={<Replay />} />
        <Route path="/case/:id/report" element={<Report />} />
        <Route path="/review" element={<Review />} />
      </Routes>
    </Router>
  );
}
