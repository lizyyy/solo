import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Layout from "@/components/Layout"
import Overview from "@/pages/Overview"
import ImportPage from "@/pages/ImportPage"
import SupplementPage from "@/pages/SupplementPage"
import AuditPage from "@/pages/AuditPage"
import HistoryPage from "@/pages/HistoryPage"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/supplement" element={<SupplementPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
