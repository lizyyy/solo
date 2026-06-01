import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import TopBar from '@/components/layout/TopBar'
import Home from '@/pages/Home'
import DataManagement from '@/pages/DataManagement'
import Plans from '@/pages/Plans'
import Report from '@/pages/Report'

export default function App() {
  return (
    <Router>
      <div className="h-screen w-screen flex flex-col bg-[#0A1520] text-slate-200 overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-hidden relative">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/data" element={<DataManagement />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/report" element={<Report />} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}
