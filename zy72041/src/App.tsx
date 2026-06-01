import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import HomePage from "@/pages/HomePage";
import GamePage from "@/pages/GamePage";
import ResultPage from "@/pages/ResultPage";

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/game/:levelId" element={<GamePage />} />
          <Route path="/result/:gameId" element={<ResultPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
