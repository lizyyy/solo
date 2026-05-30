import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Layout from "@/components/Layout"
import DashboardPage from "@/pages/DashboardPage"
import TracePage from "@/pages/TracePage"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/trace" element={<TracePage />} />
        </Route>
      </Routes>
    </Router>
  )
}
