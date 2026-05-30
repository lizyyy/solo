import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { initializeMockData } from './data/mockData'
import { useAppStore } from './store/useAppStore'
import { db } from './db'
import { getAlignedSamplesByDevice, getSegmentsByDevice, getAnomaliesByDevice } from './db/queries'

function AppInitializer() {
  const { 
    setAlignedSamples, 
    setSegments, 
    setAnomalies,
    setLoading,
    setError,
    currentDeviceId
  } = useAppStore();

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const count = await db.rawSamples.count();
        if (count === 0) {
          console.log('Initializing mock data...');
          await initializeMockData();
        } else {
          console.log(`Database already has ${count} samples, skipping mock init`);
        }

        const [samples, segments, anomalies] = await Promise.all([
          getAlignedSamplesByDevice(currentDeviceId),
          getSegmentsByDevice(currentDeviceId),
          getAnomaliesByDevice(currentDeviceId),
        ]);

        setAlignedSamples(samples);
        setSegments(segments);
        setAnomalies(anomalies);

        console.log('App initialized successfully');
        console.log(`Loaded ${samples.length} samples, ${segments.length} segments, ${anomalies.length} anomalies`);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setError(error instanceof Error ? error.message : '初始化失败');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [currentDeviceId, setAlignedSamples, setSegments, setAnomalies, setLoading, setError]);

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppInitializer />
  </StrictMode>,
)
