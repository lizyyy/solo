import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from '@/pages/Home'
import Levels from '@/pages/Levels'
import Play from '@/pages/Play'
import Record from '@/pages/Record'
import Report from '@/pages/Report'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/levels" element={<Levels />} />
        <Route path="/play/:levelId" element={<Play />} />
        <Route path="/record/:studentName" element={<Record />} />
        <Route path="/report" element={<Report />} />
      </Routes>
    </Router>
  )
}
