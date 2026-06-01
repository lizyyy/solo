import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { useStore } from '@/store'

function DataInitializer({ children }: { children: React.ReactNode }) {
  const loadData = useStore((s) => s.loadData)
  useEffect(() => {
    loadData()
  }, [loadData])
  return <>{children}</>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataInitializer>
      <App />
    </DataInitializer>
  </StrictMode>,
)
