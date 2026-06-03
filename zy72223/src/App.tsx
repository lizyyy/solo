import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Layout from "@/components/Layout"
import Dashboard from "@/pages/Dashboard"
import Notes from "@/pages/Notes"
import SummaryPage from "@/pages/SummaryPage"
import AuditLogPage from "@/pages/AuditLogPage"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
