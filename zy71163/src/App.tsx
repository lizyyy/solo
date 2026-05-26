import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Game from "@/pages/Game";
import Result from "@/pages/Result";
import History from "@/pages/History";
import Replay from "@/pages/Replay";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:levelId" element={<Game />} />
        <Route path="/result/:gameId" element={<Result />} />
        <Route path="/history" element={<History />} />
        <Route path="/replay/:gameId" element={<Replay />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Router>
  );
}
