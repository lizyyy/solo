import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Layout from "@/components/Layout"
import Import from "@/pages/Import"
import Board from "@/pages/Board"
import Review from "@/pages/Review"
import History from "@/pages/History"
import Export from "@/pages/Export"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/board" replace />} />
          <Route path="/import" element={<Import />} />
          <Route path="/board" element={<Board />} />
          <Route path="/review" element={<Review />} />
          <Route path="/history" element={<History />} />
          <Route path="/export" element={<Export />} />
        </Route>
      </Routes>
    </Router>
  )
}
