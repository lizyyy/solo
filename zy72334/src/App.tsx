import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Layout from "@/components/Layout"
import ImportPage from "@/pages/ImportPage"
import WeightsPage from "@/pages/WeightsPage"
import ReportPage from "@/pages/ReportPage"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ImportPage />} />
          <Route path="/weights" element={<WeightsPage />} />
          <Route path="/report" element={<ReportPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
