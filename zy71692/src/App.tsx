import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import ClassroomPage from '@/pages/ClassroomPage'
import AnalysisPage from '@/pages/AnalysisPage'
import StudentsPage from '@/pages/StudentsPage'
import ReportPage from '@/pages/ReportPage'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ClassroomPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

