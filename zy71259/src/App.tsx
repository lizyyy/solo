import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import AppLayout from "@/components/layout/AppLayout"
import OverviewPage from "@/pages/OverviewPage"
import DetailPage from "@/pages/DetailPage"
import ReviewPage from "@/pages/ReviewPage"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/detail" element={<DetailPage />} />
          <Route path="/review" element={<ReviewPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
