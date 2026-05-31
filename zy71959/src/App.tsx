import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Home from "@/pages/Home"
import RouteDetail from "@/pages/RouteDetail"
import Sidebar from "@/components/Sidebar"

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-56 p-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/route/:id" element={<RouteDetail />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}
