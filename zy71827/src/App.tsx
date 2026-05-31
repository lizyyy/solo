import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import DropConfigPage from "@/pages/DropConfigPage";
import LeaderboardPage from "@/pages/LeaderboardPage";
import RewardsPage from "@/pages/RewardsPage";
import ReviewPage from "@/pages/ReviewPage";
import MissedRewardsPage from "@/pages/MissedRewardsPage";
import { useAppStore } from "@/store/useAppStore";

function AppRoutes() {
  const { initDB } = useAppStore();

  useEffect(() => {
    initDB();
  }, [initDB]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/drop-config" element={<DropConfigPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/rewards" element={<RewardsPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/missed" element={<MissedRewardsPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
