import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useStore } from './store/useStore'
import './index.css'

useStore.getState().loadFromStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
