import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Dashboard from "@/pages/Dashboard"
import ReviewDetail from "@/pages/ReviewDetail"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/review/:id" element={<ReviewDetail />} />
      </Routes>
    </Router>
  )
}
