import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import WorkshopPage from "@/pages/WorkshopPage"
import ReviewPage from "@/pages/ReviewPage"
import ReportsPage from "@/pages/ReportsPage"
import NavBar from "@/components/NavBar"

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-navy-900">
        <Routes>
          <Route path="/" element={<><NavBar /><WorkshopPage /></>} />
          <Route path="/review" element={<><NavBar /><ReviewPage /></>} />
          <Route path="/reports" element={<><NavBar /><ReportsPage /></>} />
        </Routes>
      </div>
    </Router>
  )
}
