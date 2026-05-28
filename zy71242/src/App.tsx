import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Lobby from "@/pages/Lobby";
import Desk from "@/pages/Desk";
import Valuate from "@/pages/Valuate";
import Auction from "@/pages/Auction";
import Analysis from "@/pages/Analysis";
import Report from "@/pages/Report";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/case/:lotId" element={<Desk />} />
        <Route path="/case/:lotId/valuate" element={<Valuate />} />
        <Route path="/case/:lotId/auction" element={<Auction />} />
        <Route path="/case/:lotId/analysis" element={<Analysis />} />
        <Route path="/case/:lotId/report" element={<Report />} />
      </Routes>
    </Router>
  );
}
