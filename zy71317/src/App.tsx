import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import ExperimentConsole from "@/pages/ExperimentConsole"
import DataManagement from "@/pages/DataManagement"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ExperimentConsole />} />
        <Route path="/data" element={<DataManagement />} />
      </Routes>
    </Router>
  )
}
