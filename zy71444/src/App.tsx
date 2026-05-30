import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import RiskTower from "@/pages/RiskTower"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RiskTower />} />
      </Routes>
    </Router>
  )
}
