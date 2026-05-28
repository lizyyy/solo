import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import { GamePage } from "@/pages/Game";
import { ReviewPage } from "@/pages/Review";
import { MaterialsPage } from "@/pages/Materials";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:materialId" element={<GamePage />} />
        <Route path="/review/:gameId" element={<ReviewPage />} />
        <Route path="/materials" element={<MaterialsPage />} />
        <Route path="/materials/:tab" element={<MaterialsPage />} />
      </Routes>
    </Router>
  );
}
