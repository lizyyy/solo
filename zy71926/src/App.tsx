import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import RegistrationList from '@/pages/RegistrationList';
import RegistrationDetail from '@/pages/RegistrationDetail';
import AnomalyPanel from '@/pages/AnomalyPanel';
import { useStore } from '@/store';
import { useEffect } from 'react';

function AppInitializer({ children }: { children: React.ReactNode }) {
  const { initMockData, registrations } = useStore();

  useEffect(() => {
    if (registrations.length === 0) {
      initMockData();
    }
  }, [initMockData, registrations.length]);

  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <AppInitializer>
        <div className="h-screen flex flex-col bg-console-bg text-console-text font-mono">
          <Routes>
            <Route path="/" element={<RegistrationList />} />
            <Route path="/registration/:id" element={<RegistrationDetail />} />
            <Route path="/anomalies" element={<AnomalyPanel />} />
          </Routes>
        </div>
      </AppInitializer>
    </Router>
  );
}
