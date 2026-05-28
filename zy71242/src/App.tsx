import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Lobby from "@/pages/Lobby";
import Desk from "@/pages/Desk";
import Valuate from "@/pages/Valuate";
import Auction from "@/pages/Auction";
import Analysis from "@/pages/Analysis";
import Report from "@/pages/Report";
import { useGameStore } from "@/store";

function AppContent() {
  const hydrateFromServer = useGameStore(s => s.hydrateFromServer);

  useEffect(() => {
    hydrateFromServer();
  }, [hydrateFromServer]);

  return (
    <Routes>
      <Route path="/" element={<Lobby />} />
      <Route path="/case/:lotId" element={<Desk />} />
      <Route path="/case/:lotId/valuate" element={<Valuate />} />
      <Route path="/case/:lotId/auction" element={<Auction />} />
      <Route path="/case/:lotId/analysis" element={<Analysis />} />
      <Route path="/case/:lotId/report" element={<Report />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
