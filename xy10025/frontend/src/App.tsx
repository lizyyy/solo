import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';

function App() {
  const { isAuthenticated, init } = useAuthStore();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />}
      />
      <Route
        path="/*"
        element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}

export default App;
