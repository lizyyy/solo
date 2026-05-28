import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Game from "@/pages/Game";
import Conclusion from "@/pages/Conclusion";
import Replay from "@/pages/Replay";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:levelId" element={<Game />} />
        <Route path="/game/:levelId/conclusion" element={<Conclusion />} />
        <Route path="/replay/:sessionId" element={<Replay />} />
      </Routes>
    </Router>
  );
}
