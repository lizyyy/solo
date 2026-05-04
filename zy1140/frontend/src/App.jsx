import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Notification } from './components/ui/Notification';
import useStore from './store';
import Dashboard from './pages/Dashboard';
import Import from './pages/Import';
import CalendarHeatmap from './pages/CalendarHeatmap';
import Workouts from './pages/Workouts';
import Anomalies from './pages/Anomalies';
import Settings from './pages/Settings';
import Report from './pages/Report';
import { useEffect } from 'react';

function App() {
  const { notification, clearNotification } = useStore();
  
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(clearNotification, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);
  
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<Import />} />
          <Route path="/calendar" element={<CalendarHeatmap />} />
          <Route path="/workouts" element={<Workouts />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/report" element={<Report />} />
        </Routes>
      </Layout>
      
      {notification && (
        <div className="fixed top-4 right-4 z-50">
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={clearNotification}
          />
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;
