import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Layout from "@/components/Layout"
import Dashboard from "@/pages/Dashboard"
import DataEntry from "@/pages/DataEntry"
import ParameterTrace from "@/pages/ParameterTrace"
import AnomalyDetail from "@/pages/AnomalyDetail"
import ExportPage from "@/pages/ExportPage"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/data-entry" element={<DataEntry />} />
          <Route path="/parameter-trace" element={<ParameterTrace />} />
          <Route path="/anomaly-detail" element={<AnomalyDetail />} />
          <Route path="/export" element={<ExportPage />} />
        </Route>
      </Routes>
    </Router>
  )
}
