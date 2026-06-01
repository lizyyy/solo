import { Routes, Route } from 'react-router-dom'
import GamePage from './pages/GamePage'
import ConfigPage from './pages/ConfigPage'
import ResultPage from './pages/ResultPage'
import ExportPage from './pages/ExportPage'
import ErrorPage from './pages/ErrorPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GamePage />} />
      <Route path="/config" element={<ConfigPage />} />
      <Route path="/result" element={<ResultPage />} />
      <Route path="/export" element={<ExportPage />} />
      <Route path="/error" element={<ErrorPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
