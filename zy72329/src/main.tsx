import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { useAuthStore } from './store/authStore'

function AppInitializer() {
  const initialize = useAuthStore((state) => state.initialize)

  useEffect(() => {
    initialize()

    const handleAuthLogout = () => {
      window.location.href = '/login'
    }

    window.addEventListener('auth:logout', handleAuthLogout)
    return () => window.removeEventListener('auth:logout', handleAuthLogout)
  }, [initialize])

  return <App />
}

export default function Root() {
  return (
    <StrictMode>
      <AppInitializer />
    </StrictMode>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)
