import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Layout from "@/components/Layout"
import TimelinePage from "@/pages/Timeline"
import ImportPage from "@/pages/Import"
import ReportPage from "@/pages/Report"

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<TimelinePage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/report" element={<ReportPage />} />
        </Routes>
      </Layout>
    </Router>
  )
}
