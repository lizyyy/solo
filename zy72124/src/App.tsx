import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Dashboard from "@/pages/Dashboard"
import ThresholdManagement from "@/pages/ThresholdManagement"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/threshold" element={<ThresholdManagement />} />
      </Routes>
    </Router>
  )
}
