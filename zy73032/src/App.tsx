import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Dashboard from './pages/Dashboard'
import ImportCenter from './pages/ImportCenter'
import ScheduleList from './pages/ScheduleList'
import AnomalyTracker from './pages/AnomalyTracker'
import OperationLog from './pages/OperationLog'
import { useReconcileStore } from './store/useReconcileStore'

export default function App() {
  const fetchAll = useReconcileStore((s) => s.fetchAll)
  const resetDemo = useReconcileStore((s) => s.resetDemo)

  useEffect(() => {
    const init = async () => {
      await resetDemo()
      await fetchAll()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/import" element={<ImportCenter />} />
        <Route path="/schedules" element={<ScheduleList />} />
        <Route path="/anomalies" element={<AnomalyTracker />} />
        <Route path="/logs" element={<OperationLog />} />
      </Routes>
    </AppLayout>
  )
}
