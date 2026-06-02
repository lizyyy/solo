import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AppInit from './components/AppInit'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppInit>
      <App />
    </AppInit>
  </StrictMode>,
)
