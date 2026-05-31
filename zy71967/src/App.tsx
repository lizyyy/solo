import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import AppLayout from "@/components/Layout/AppLayout"
import Dashboard from "@/pages/Dashboard"
import DataManage from "@/pages/DataManage"
import Evaluation from "@/pages/Evaluation"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/manage" element={<DataManage />} />
          <Route path="/evaluation" element={<Evaluation />} />
        </Route>
      </Routes>
    </Router>
  )
}
