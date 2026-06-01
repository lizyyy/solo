import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Header from "@/components/Header"
import Home from "@/pages/Home"
import Training from "@/pages/Training"
import Result from "@/pages/Result"
import History from "@/pages/History"
import RecordDetail from "@/pages/RecordDetail"
import Summary from "@/pages/Summary"

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
        <div
          className="fixed inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255, 107, 53, 0.15) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(74, 222, 128, 0.08) 0%, transparent 40%)",
          }}
        />
        <Header />
        <main className="relative">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/training" element={<Training />} />
            <Route path="/result/:id" element={<Result />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/:id" element={<RecordDetail />} />
            <Route path="/summary" element={<Summary />} />
            <Route
              path="*"
              element={
                <div className="container py-16 text-center">
                  <h1 className="text-4xl font-bold mb-4">404</h1>
                  <p className="text-slate-400">页面不存在</p>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
    </Router>
  )
}
