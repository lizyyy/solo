import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { LevelSelect } from "@/pages/LevelSelect";
import { Game } from "@/pages/Game";
import { Settlement } from "@/pages/Settlement";
import { Replay } from "@/pages/Replay";
import { ReplayList } from "@/pages/ReplayList";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LevelSelect />} />
        <Route path="/game/:levelId" element={<Game />} />
        <Route path="/settlement" element={<Settlement />} />
        <Route path="/replay/:recordId" element={<Replay />} />
        <Route path="/replay-list" element={<ReplayList />} />
        <Route path="*" element={<LevelSelect />} />
      </Routes>
    </Router>
  );
}
