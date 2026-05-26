import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Menu } from "@/pages/Menu";
import { Game } from "@/pages/Game";
import { Result } from "@/pages/Result";
import { Replay } from "@/pages/Replay";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/game/:levelId" element={<Game />} />
        <Route path="/result/:gameId" element={<Result />} />
        <Route path="/replay/:gameId" element={<Replay />} />
      </Routes>
    </Router>
  );
}
