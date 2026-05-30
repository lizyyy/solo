import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import StagePage from "@/pages/StagePage"
import ReviewPage from "@/pages/ReviewPage"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StagePage />} />
        <Route path="/review" element={<ReviewPage />} />
      </Routes>
    </Router>
  )
}
