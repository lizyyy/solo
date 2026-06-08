import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Layout from "@/components/Layout"
import Workspace from "@/pages/Workspace"
import Conflict from "@/pages/Conflict"
import SelfCheck from "@/pages/SelfCheck"
import RowDetailDrawer from "@/components/RowDetailDrawer"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Workspace />} />
          <Route path="/conflict" element={<Conflict />} />
          <Route path="/check" element={<SelfCheck />} />
        </Route>
      </Routes>
      <RowDetailDrawer />
    </Router>
  )
}
