import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Home from "@/pages/Home"
import Overview from "@/pages/Overview"
import ImportPage from "@/pages/ImportPage"
import WeightsPage from "@/pages/WeightsPage"
import CalculationPage from "@/pages/CalculationPage"
import StepNav from "@/components/StepNav"
import { useStore } from "@/store/useStore"

function Layout({ children }: { children: React.ReactNode }) {
  const steps = useStore(s => s.steps)

  return (
    <div className="flex min-h-screen bg-white">
      <StepNav steps={steps} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/home" element={<Home />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/weights" element={<WeightsPage />} />
          <Route path="/calculation" element={<CalculationPage />} />
        </Routes>
      </Layout>
    </Router>
  )
}
