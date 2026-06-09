import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { useThresholdStore } from './store/thresholdStore'

const Root = () => {
  useEffect(() => {
    useThresholdStore.getState().loadPersisted();

    const handleUnload = () => {
      useThresholdStore.getState().persist();
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      handleUnload();
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  return <App />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
