import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { MainMenu } from "@/pages/MainMenu";
import { GameBoard } from "@/pages/GameBoard";
import { HistoryPage } from "@/pages/History";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/game/:levelId" element={<GameBoard />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </Router>
  );
}
