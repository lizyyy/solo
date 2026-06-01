import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Layout from "@/components/Layout"
import InputPage from "@/pages/InputPage"
import DashboardPage from "@/pages/DashboardPage"
import ComparePage from "@/pages/ComparePage"
import ReportPage from "@/pages/ReportPage"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/input" replace />} />
          <Route path="/input" element={<InputPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/report" element={<ReportPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
