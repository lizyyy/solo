import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import BusTimeManagement from '@/pages/BusTimeManagement';
import RedlineRemarkManagement from '@/pages/RedlineRemarkManagement';
import StallRotation from '@/pages/StallRotation';
import MapView from '@/pages/MapView';
import OperationHistory from '@/pages/OperationHistory';
import ReviewCenter from '@/pages/ReviewCenter';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { currentUser } = useAppStore();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/bus-time"
          element={
            <ProtectedRoute>
              <BusTimeManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/redline-remark"
          element={
            <ProtectedRoute>
              <RedlineRemarkManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/stall-rotation"
          element={
            <ProtectedRoute>
              <StallRotation />
            </ProtectedRoute>
          }
        />

        <Route
          path="/map-view"
          element={
            <ProtectedRoute>
              <MapView />
            </ProtectedRoute>
          }
        />

        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <OperationHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/review"
          element={
            <ProtectedRoute allowedRoles={['manager', 'admin']}>
              <ReviewCenter />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
