import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Level from "@/pages/Level";
import Replay from "@/pages/Replay";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/level/:id" element={<Level />} />
        <Route path="/replay/:id" element={<Replay />} />
      </Routes>
    </Router>
  );
}
