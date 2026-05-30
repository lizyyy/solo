import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ReceiptPage from './pages/ReceiptPage'
import AllocationPage from './pages/AllocationPage'
import ReviewPage from './pages/ReviewPage'
import ExportPage from './pages/ExportPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ReceiptPage />} />
        <Route path="/allocation" element={<AllocationPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/export" element={<ExportPage />} />
      </Routes>
    </Layout>
  )
}

export default App
