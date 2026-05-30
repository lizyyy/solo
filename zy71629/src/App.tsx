import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Login from "@/pages/Login";
import Lobby from "@/pages/Lobby";
import Game from "@/pages/Game";
import Results from "@/pages/Results";
import Playback from "@/pages/Playback";
import TeacherConsole from "@/pages/TeacherConsole";
import Reports from "@/pages/Reports";
import Materials from "@/pages/Materials";
import SampleGuide from "@/pages/SampleGuide";
import { initializeUserFromStorage } from "@/store/useUserStore";

export default function App() {
  useEffect(() => {
    initializeUserFromStorage();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/game/:gameId" element={<Game />} />
        <Route path="/results/:sessionId" element={<Results />} />
        <Route path="/playback/:sessionId" element={<Playback />} />
        <Route path="/console" element={<TeacherConsole />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/materials" element={<Materials />} />
        <Route path="/sample-guide" element={<SampleGuide />} />
      </Routes>
    </Router>
  );
}
