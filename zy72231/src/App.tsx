import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Layout from "@/components/Layout"
import Dashboard from "@/pages/Dashboard"
import ImportPage from "@/pages/ImportPage"
import RecordDetail from "@/pages/RecordDetail"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/record/:id" element={<RecordDetail />} />
        </Route>
      </Routes>
    </Router>
  )
}
