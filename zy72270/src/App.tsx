import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Layout from "@/components/Layout"
import ImportPage from "@/pages/ImportPage"
import ReviewPage from "@/pages/ReviewPage"
import ObstructionsPage from "@/pages/ObstructionsPage"
import GradingPage from "@/pages/GradingPage"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/import" replace />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/obstructions" element={<ObstructionsPage />} />
          <Route path="/grading" element={<GradingPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
