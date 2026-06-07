import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { ImportPage } from './pages/ImportPage';
import { ExceptionList } from './pages/ExceptionList';
import { RecordDetail } from './pages/RecordDetail';
import { DocsPage } from './pages/DocsPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/exceptions" element={<ExceptionList />} />
        <Route path="/record/:id" element={<RecordDetail />} />
        <Route path="/docs" element={<DocsPage />} />
      </Routes>
    </Router>
  );
}
