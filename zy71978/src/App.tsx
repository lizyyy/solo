import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Layout from "@/components/Layout"
import Timeline from "@/pages/Timeline"
import Inspection from "@/pages/Inspection"
import WeeklyReport from "@/pages/WeeklyReport"
import Guide from "@/pages/Guide"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/timeline" replace />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/inspection" element={<Inspection />} />
          <Route path="/weekly-report" element={<WeeklyReport />} />
          <Route path="/guide" element={<Guide />} />
        </Route>
      </Routes>
    </Router>
  )
}
