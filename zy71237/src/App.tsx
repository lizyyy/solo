import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { IntroPage } from "@/pages/IntroPage";
import { GamePage } from "@/pages/GamePage";
import { ResultPage } from "@/pages/ResultPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<IntroPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/result" element={<ResultPage />} />
      </Routes>
    </Router>
  );
}
