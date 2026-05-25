import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import StartScreen from "@/pages/StartScreen";
import GameScreen from "@/pages/GameScreen";
import ResultScreen from "@/pages/ResultScreen";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/game" element={<GameScreen />} />
        <Route path="/result" element={<ResultScreen />} />
      </Routes>
    </Router>
  );
}
