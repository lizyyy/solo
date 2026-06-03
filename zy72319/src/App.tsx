import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Layout from "@/components/Layout"
import Dashboard from "@/pages/Dashboard"
import CounterExamples from "@/pages/CounterExamples"
import Runs from "@/pages/Runs"
import Checks from "@/pages/Checks"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/counter-examples" element={<CounterExamples />} />
          <Route path="/runs" element={<Runs />} />
          <Route path="/checks" element={<Checks />} />
        </Route>
      </Routes>
    </Router>
  )
}
