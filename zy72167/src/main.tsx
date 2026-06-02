import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { useCarbonStore } from './store/carbonStore'

function AppInitializer() {
  const init = useCarbonStore(state => state.init)

  useEffect(() => {
    init()
  }, [init])

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppInitializer />
  </StrictMode>,
)
