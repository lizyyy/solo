import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ImportPage } from './pages/ImportPage';
import { RoutesPage } from './pages/RoutesPage';
import { WeightsPage } from './pages/WeightsPage';
import { VersionsPage } from './pages/VersionsPage';
import { SelfCheckPage } from './pages/SelfCheckPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/import" replace />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="routes" element={<RoutesPage />} />
          <Route path="weights" element={<WeightsPage />} />
          <Route path="versions" element={<VersionsPage />} />
          <Route path="self-check" element={<SelfCheckPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
