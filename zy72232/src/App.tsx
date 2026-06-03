import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Layout from "@/components/Layout"
import Home from "@/pages/Home"
import ImportPage from "@/pages/ImportPage"
import RecordDetail from "@/pages/RecordDetail"
import Review from "@/pages/Review"
import AuditLog from "@/pages/AuditLog"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/record/:id" element={<RecordDetail />} />
          <Route path="/review" element={<Review />} />
          <Route path="/audit-log" element={<AuditLog />} />
        </Route>
      </Routes>
    </Router>
  )
}
