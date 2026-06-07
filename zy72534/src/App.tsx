import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import Dashboard from './pages/Dashboard';
import BatchImport from './pages/BatchImport';
import BatchList from './pages/BatchList';
import SampleDetail from './pages/SampleDetail';
import ReviewPage from './pages/ReviewPage';
import AnomaliesPage from './pages/AnomaliesPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/batch/import" element={<BatchImport />} />
          <Route path="/batch/list" element={<BatchList />} />
          <Route path="/sample/:id" element={<SampleDetail />} />
          <Route path="/review/:id" element={<ReviewPage />} />
          <Route path="/anomalies" element={<AnomaliesPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
