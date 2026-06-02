import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Layout from "@/components/Layout"
import Samples from "@/pages/Samples"
import Replay from "@/pages/Replay"
import Metrics from "@/pages/Metrics"
import Report from "@/pages/Report"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/samples" replace />} />
          <Route path="/samples" element={<Samples />} />
          <Route path="/replay" element={<Replay />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/report" element={<Report />} />
        </Route>
      </Routes>
    </Router>
  )
}
