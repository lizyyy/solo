import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import DataInput from "@/pages/DataInput"
import Workspace from "@/pages/Workspace"
import Report from "@/pages/Report"
import History from "@/pages/History"
import Layout from "@/components/Layout"

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<DataInput />} />
          <Route path="/workspace" element={<Workspace />} />
          <Route path="/report" element={<Report />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </Layout>
    </Router>
  )
}
