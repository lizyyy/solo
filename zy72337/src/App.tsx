import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Layout from "@/components/Layout"
import Home from "@/pages/Home"
import Params from "@/pages/Params"
import Counterexamples from "@/pages/Counterexamples"
import Checks from "@/pages/Checks"
import Demo from "@/pages/Demo"

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/params" element={<Params />} />
          <Route path="/counterexamples" element={<Counterexamples />} />
          <Route path="/checks" element={<Checks />} />
          <Route path="/demo" element={<Demo />} />
        </Routes>
      </Layout>
    </Router>
  )
}
