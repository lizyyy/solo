import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import AppLayout from "@/components/Layout"
import Dashboard from "@/pages/Dashboard"
import Ledger from "@/pages/Ledger"
import Guide from "@/pages/Guide"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Router>
  )
}
