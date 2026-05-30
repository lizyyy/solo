import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { HomePage } from "@/pages/HomePage";
import { GamePage } from "@/pages/GamePage";
import { ResultPage } from "@/pages/ResultPage";
import { TeacherHistoryPage } from "@/pages/TeacherHistoryPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game/:levelId" element={<GamePage />} />
        <Route path="/result/:levelId" element={<ResultPage />} />
        <Route path="/teacher/history" element={<TeacherHistoryPage />} />
      </Routes>
    </Router>
  );
}
