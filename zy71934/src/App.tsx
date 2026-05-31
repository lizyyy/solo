import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Layout from "@/components/Layout"
import Timeline from "@/pages/Timeline"
import Schedule from "@/pages/Schedule"
import Delivery from "@/pages/Delivery"
import Guide from "@/pages/Guide"
import FileDetailPanel from "@/components/FileDetailPanel"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/delivery" element={<Delivery />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/" element={<Navigate to="/timeline" replace />} />
        </Route>
      </Routes>
      <FileDetailPanel />
    </Router>
  )
}
