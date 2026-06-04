import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Layout from "@/components/Layout"
import ImportPage from "@/pages/ImportPage"
import ReviewPage from "@/pages/ReviewPage"
import AnomaliesPage from "@/pages/AnomaliesPage"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/import" replace />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/anomalies" element={<AnomaliesPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
