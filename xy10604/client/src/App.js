import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Batches from './pages/Batches';
import Experiments from './pages/Experiments';
import Blocks from './pages/Blocks';
import Reviews from './pages/Reviews';
import Discards from './pages/Discards';
import AuditLog from './pages/AuditLog';
import BatchDetail from './pages/BatchDetail';
import ExperimentDetail from './pages/ExperimentDetail';
import Exports from './pages/Exports';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return !isAuthenticated ? children : <Navigate to="/" />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="batches" element={<Batches />} />
          <Route path="batches/:id" element={<BatchDetail />} />
          <Route path="experiments" element={<Experiments />} />
          <Route path="experiments/:id" element={<ExperimentDetail />} />
          <Route path="blocks" element={<Blocks />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="discards" element={<Discards />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="exports" element={<Exports />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
