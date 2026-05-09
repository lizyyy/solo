import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import RequestList from './pages/RequestList';
import RequestDetail from './pages/RequestDetail';
import Dashboard from './pages/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/requests" replace />} />
          <Route path="/requests" element={<RequestList />} />
          <Route path="/requests/:id" element={<RequestDetail />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
