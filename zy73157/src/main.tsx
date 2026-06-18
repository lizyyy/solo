import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

try {
  const rootEl = document.getElementById('root')!;
  rootEl.innerHTML = '<div style="padding:20px;color:#fff;font-family:monospace;">REACT_MOUNT_STARTING...</div>';
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  setTimeout(() => {
    if (rootEl.innerText.includes('REACT_MOUNT_STARTING')) {
      rootEl.innerHTML = '<div style="padding:20px;color:#fff;font-family:monospace;">APP_FROZEN<br>' + rootEl.innerHTML + '</div>';
    }
  }, 3000);
} catch (e: any) {
  document.getElementById('root')!.innerHTML =
    '<pre style="color:#ff6b6b;padding:20px;">INIT ERROR:\n' + String(e && e.stack || e) + '</pre>';
}
