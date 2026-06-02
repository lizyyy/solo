import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Layout from "@/components/Layout"
import Dashboard from "@/pages/Dashboard"
import ImportPage from "@/pages/ImportPage"
import MergePage from "@/pages/MergePage"
import ReviewPage from "@/pages/ReviewPage"
import ExportPage from "@/pages/ExportPage"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/merge" element={<MergePage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/export" element={<ExportPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
