import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Home from "@/pages/Home"
import Game from "@/pages/Game"
import Report from "@/pages/Report"
import ReplayList from "@/pages/ReplayList"
import ReplayDetail from "@/pages/ReplayDetail"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game" element={<Game />} />
        <Route path="/report" element={<Report />} />
        <Route path="/replay" element={<ReplayList />} />
        <Route path="/replay/:id" element={<ReplayDetail />} />
      </Routes>
    </Router>
  )
}
