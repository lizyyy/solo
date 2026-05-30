import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Home from "@/pages/Home"
import GamePage from "@/pages/GamePage"
import ReplayPage from "@/pages/ReplayPage"
import ReportPage from "@/pages/ReportPage"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:levelId" element={<GamePage />} />
        <Route path="/replay/:levelId" element={<ReplayPage />} />
        <Route path="/report" element={<ReportPage />} />
      </Routes>
    </Router>
  )
}
