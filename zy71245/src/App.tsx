import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Game from "@/pages/Game";
import Conclusion from "@/pages/Conclusion";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:levelId" element={<Game />} />
        <Route path="/game/:levelId/conclusion" element={<Conclusion />} />
      </Routes>
    </Router>
  );
}
