import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import LightRecords from '@/pages/LightRecords'
import TrackParams from '@/pages/TrackParams'
import CarParams from '@/pages/CarParams'
import Estimation from '@/pages/Estimation'
import { useAppStore } from '@/hooks/useAppStore'
import { useEffect } from 'react'

function Toast() {
  const { toastMessage, toastType, clearToast } = useAppStore()
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(clearToast, 3000)
      return () => clearTimeout(t)
    }
  }, [toastMessage, clearToast])

  if (!toastMessage) return null
  const bg = toastType === 'error' ? 'bg-red-500/90' : toastType === 'success' ? 'bg-emerald-500/90' : 'bg-blue-500/90'
  return (
    <div className={`fixed top-4 right-4 z-50 ${bg} text-white px-4 py-2 rounded-lg text-sm shadow-lg`}>
      {toastMessage}
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <Toast />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/light-records" element={<LightRecords />} />
          <Route path="/track-params" element={<TrackParams />} />
          <Route path="/car-params" element={<CarParams />} />
          <Route path="/estimation" element={<Estimation />} />
        </Routes>
      </Layout>
    </Router>
  )
}
