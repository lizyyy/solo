import { DashboardProvider } from './context/DashboardContext'
import Dashboard from './pages/Dashboard'

function App() {
  return (
    <DashboardProvider>
      <Dashboard />
    </DashboardProvider>
  )
}

export default App
