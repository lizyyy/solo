import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Console from "@/pages/Console";
import MatchScreen from "@/pages/MatchScreen";
import Settlement from "@/pages/Settlement";
import Replay from "@/pages/Replay";
import ReplayDetail from "@/pages/ReplayDetail";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Console />} />
        <Route path="/match/:id" element={<MatchScreen />} />
        <Route path="/match/:id/settlement" element={<Settlement />} />
        <Route path="/replay" element={<Replay />} />
        <Route path="/replay/:id" element={<ReplayDetail />} />
      </Routes>
    </Router>
  );
}
